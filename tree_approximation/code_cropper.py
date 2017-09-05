"""
Code cropper: first step of feature extraction process
select snippet from code and prepare X & y:
X - code without snippet
y - snippet, position in initial code, UAST of this snippet
"""
from random import randint
from typing import Union

import ast2vec
from ast2vec.bblfsh_roles import _get_role_id as get_role_id
from ast2vec.repo2.base import Repo2Base, RepoTransformer
from modelforge import generate_meta
from modelforge.model import Model, split_strings, write_model, merge_strings

FOR_EACH = get_role_id("FOR_EACH")
FUNCTION_DECLARATION = get_role_id("FUNCTION_DECLARATION")
SIMPLE_IDENTIFIER = get_role_id("SIMPLE_IDENTIFIER")


class CodeCropperBaseModel(Model):
    NAME = "CodeCropperBaseModel"

    def construct(self, X=None, y_text=None, y_pos=None, y_uast=None):
        self._X = X
        self._y_text = y_text
        self._y_pos = y_pos
        self._y_uast = y_uast
        return self

    @property
    def X(self):
        return self._X

    @property
    def y(self):
        return self._y_text, self._y_pos, self._y_uast

    @property
    def y_text(self):
        return self._y_text

    @property
    def y_pos(self):
        return self._y_pos

    @property
    def y_uast(self):
        return self._y_uast

    def dump(self) -> str:
        """
        Returns the string with the brief information about the model.
        Should not include any metadata.
        """
        desc = """Code cropper model:
X - code with missing part - this code should be valid for UAST extraction.
y - missing part of code & related UAST.
Number of samples: {}""" % (len(self.X))
        return desc

    def _to_dict(self):
        return {"X": merge_strings(self.X), "y_text": merge_strings(self.y_text),
                "y_pos": self.y_pos, "y_uast": merge_strings([uast.SerializeToString()
                                                              for uast in self.y_uast])}

    def save(self, output, deps: Union[None, list]=None) -> None:
        """
        Serializes the model on disk.

        :param output: path to the file.
        :param deps: the list of dependencies.
        :return: None
        """
        if not deps:
            deps = tuple()
        self._meta = generate_meta(self.NAME, ast2vec.__version__, *deps)
        write_model(self._meta, self._to_dict(), output)

    @staticmethod
    def parse_bblfsh_response(response):
        # ParseResponse should be imported here because grpc starts threads during import
        # and if you call fork after that, a child process will be hang during exit
        from bblfsh.github.com.bblfsh.sdk.uast.generated_pb2 import Node
        return Node.FromString(response)

    def _load_tree(self, tree: dict) -> None:
        """
        Attaches the needed data from the tree.

        :param tree: asdf file tree.
        :return: None
        """

        self.construct(X=split_strings(tree["X"]), y_text=split_strings(tree["y_text"]),
                       y_pos=tree["y_pos"], y_uast=[self.parse_bblfsh_response(response)
                                                    for response in split_strings(tree["y_uast"])])


class CodeCropperBase(Repo2Base):
    """
    Helper class to preprocess code.
    It should produce X & y as output:
    X - code with missing part - this code should be still valid for UAST extraction.
    y_text - extracted code snippet
    y_pos - position of snippet in initial code
    y_uast - part of UAST related to snippet
    """
    MODEL_CLASS = CodeCropperBaseModel

    def __init__(self, *args, **kwargs):
        """
        Initialization
        :param args: some arguments to pass to super
        :param kwargs: some arguments to pass to super
        """
        super(CodeCropperBase, self).__init__(*args, **kwargs)

    def _pos_extractor(self, node):
        """
        Extract position according to some logic
        :param node: UAST node
        :return: return ((start_line, start_col, end_line, end_col), node) or None
        """
        raise NotImplementedError

    def _find_positions(self, root):
        yield from self._pos_extractor(root)
        for ch in root.children:
            yield from self._find_positions(ch)

    @staticmethod
    def _one2zero_based_index(pos):
        return [p - 1 for p in pos]

    def find_positions(self, uast):
        """
        Find all positions according to _pos_extractor
        :param uast: UAST
        :return: list of (start_line, start_col, end_line, end_col) (zero-based index)
        """
        positions = [(self._one2zero_based_index(pos), node)
                     for pos, node in self._find_positions(uast)]
        return positions

    @staticmethod
    def _prepare_xy(text, positions):
        """
        Prepare X, y from 1 file

        :param text: list of strings - code itself
        :param positions: list of (pos, node)
        :return: list of (X, y)
        """
        if len(positions) == 0:
            return []

        # randomly select 1 position - can be modified in future
        pos = positions[randint(0, len(positions) - 1)]

        st_l, st_c, en_l, en_c = pos[0]

        # select code before snippet
        if st_c > 0:
            new_text = text[:st_l + 1]
            new_text[-1] = new_text[-1][:st_c]
        else:
            new_text = text[:st_l + 1]

        # select code after snippet
        if en_c < len(text[en_l]) - 1:
            new_text.append(text[en_l][en_c:])
        else:
            new_text.append("\n")
        new_text.extend(text[en_l + 1:])

        # select snippet
        snippet = text[st_l:en_l + 1]
        snippet[0] = snippet[0][st_c:]
        snippet[-1] = snippet[-1][:en_c + 1]

        uast = pos[1]
        pos = pos[1]
        return [("\n".join(new_text), "\n".join(snippet), pos, uast)]

    def convert_uasts(self, file_uast_generator):
        X, y_text, y_pos, y_uast = [], [], [], []
        for file_uast in file_uast_generator:
            text = []
            with open(file_uast.filepath) as f:
                for line in f.readlines():
                    text.append(line.rstrip())

            positions = self.find_positions(file_uast.response.uast)

            for xy in self._prepare_xy(text, positions):
                X.append(xy[0])
                y_text.append(xy[1])
                y_pos.append(xy[2])
                y_uast.append(xy[3])
        return X, y_text, y_pos, y_uast


class CodeCropperRole(CodeCropperBase):
    """
    Select specific roles
    """
    def __init__(self, *args, role=FUNCTION_DECLARATION, **kwargs):
        """
        Initialization
        :param args: some arguments to pass to super
        :param kwargs: some arguments to pass to super
        """
        super(CodeCropperBase, self).__init__(*args, **kwargs)
        self.role = role

    def _pos_extractor(self, node):
        """
        Extract position of nodes with specific role
        :param node: UAST node
        :return: return ((start_line, start_col, end_line, end_col), node) or None
        """
        if self.role in node.roles:
            if (node.start_position.line != 0) and (node.start_position.col != 0) and \
                    (node.end_position.line != 0) and (node.end_position.col != 0):
                yield ((node.start_position.line, node.start_position.col,
                       node.end_position.line, node.end_position.col), node)
            else:
                print(node.roles, node.start_position.line, node.start_position.col,
                      node.end_position.line, node.end_position.col)


class Repo2CropTransformer(RepoTransformer):
    WORKER_CLASS = CodeCropperRole

    def dependencies(self):
        return []

    def result_to_model_kwargs(self, result, url_or_path):
        X, y_text, y_pos, y_uast = result
        if not X:
            raise ValueError("Empty result")
        if len(X) != len(y_text) != len(y_pos) != len(y_uast):
            err_msg = "Different lengths: len(X) = {}, len(y_text) = {}, len(y_pos) = {}, "
            err_msg += "len(y_uast) = {}"
            raise ValueError(err_msg % (len(X), len(y_text), len(y_pos), len(y_uast)))
        return {"X": X, "y_text": y_text, "y_text": y_text, "y_uast": y_uast}

if __name__ == "__main__":
    FOR = 79
    FOR_INIT = 80
    FOR_EXPRESSION = 81
    FOR_UPDATE = 82
    FOR_BODY = 83
    FOR_EACH = 84
    cs = Repo2CropTransformer(linguist="/home/egor/workspace/ast2vec/enry")
    folder = "/home/egor/workspace/code-completion/tree_approximation/rm_data/"
    exp_subfolder = "ReactiveX&RxJava/src/main/java/io/reactivex/internal/observers/"
    cs.transform([folder + exp_subfolder], output=folder + "Xy/")
