# Use an srcd/science as a parent image
FROM srcd/science
ENV LD_PRELOAD ""
ENV LC_ALL "en_US.UTF-8"

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
ADD . /app

# * locale - so it will use UTF-8 as default codec
# * Install pytorch
# * Install Java 8 (dependency for Stanford NLP)
# * tqdm - nice progress bar
# * javac
# * fix permissions
# * fetch & preprcocess dataset
RUN locale-gen --purge en_US.UTF-8; \
 pip3 install http://download.pytorch.org/whl/cu80/torch-0.2.0.post1-cp35-cp35m-manylinux1_x86_64.whl ; \
 pip3 install torchvision; \
 apt-get update; apt-get install openjdk-8-jre -y; \
 pip3 install tqdm; \
 apt-get install default-jdk -y; \
 cd treelstm.pytorch/; chmod -R 777 *.sh; ./fetch.sh; ./preprocess.sh

# Run ipython when the container launches
CMD ["ipython3"]

