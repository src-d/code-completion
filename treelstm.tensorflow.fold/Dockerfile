# Use an srcd/science as a parent image
FROM srcd/science
ENV LD_PRELOAD ""
ENV LC_ALL "en_US.UTF-8"
EXPOSE 8888

# Downgrade tensorflow and install tensorflow/fold
# List of tensorflow wheels: https://storage.googleapis.com/tensorflow/
# TODO: Fix it
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use SSE3 instructions, but these are available on your machine and could speed up CPU computations.
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use SSE4.1 instructions, but these are available on your machine and could speed up CPU computations.
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use SSE4.2 instructions, but these are available on your machine and could speed up CPU computations.
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use AVX instructions, but these are available on your machine and could speed up CPU computations.
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use AVX2 instructions, but these are available on your machine and could speed up CPU computations.
#W tensorflow/core/platform/cpu_feature_guard.cc:45] The TensorFlow library wasn't compiled to use FMA instructions, but these are available on your machine and could speed up CPU computations.
RUN apt update; locale-gen --purge en_US.UTF-8; \
    export TF_BINARY_URL=https://storage.googleapis.com/tensorflow/linux/gpu/tensorflow_gpu-1.0.0-cp35-cp35m-linux_x86_64.whl; \
    pip3 install --ignore-installed --upgrade $TF_BINARY_URL; \
    pip3 install https://storage.googleapis.com/tensorflow_fold/tensorflow_fold-0.0.1-py3-none-linux_x86_64.whl

# Set the working directory to /workspace
WORKDIR /workspace

# Copy the current directory contents into the container
ADD . /workspace

# jupyter-notebook --ip=0.0.0.0 --port=8888 --allow-root