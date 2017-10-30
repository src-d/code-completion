# Use an srcd/science as a parent image
FROM srcd/science
ENV LD_PRELOAD ""
ENV LC_ALL "en_US.UTF-8"

# Set the working directory to /app
WORKDIR /app

# Copy the current directory contents into the container at /app
ADD . /app

# * locale - so it will use UTF-8 as default codec
# * Update keras & tensorflow
# * parso - AST extractor
RUN locale-gen --purge en_US.UTF-8; \
 pip3 install -U tensorflow-gpu; \
 pip3 install -U keras; \
 pip3 install -U parso

# Run jupyter when the container launches
CMD ["sh", "-c", "jupyter-notebook --notebook-dir=/app --no-browser --allow-root --ip=* --port=3105"]

