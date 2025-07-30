# Use the official AWS Lambda Python runtime as base image
FROM public.ecr.aws/lambda/python:3.13

# Copy requirements and install dependencies
COPY requirements.txt ${LAMBDA_TASK_ROOT}
RUN pip install -r requirements.txt

# Copy function code
COPY lambda_function_improved.py ${LAMBDA_TASK_ROOT}/lambda_function.py

# Set the CMD to your handler
CMD ["lambda_function.lambda_handler"]
