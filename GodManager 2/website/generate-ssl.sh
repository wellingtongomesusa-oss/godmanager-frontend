#!/bin/bash

# Create SSL directory
mkdir -p ssl

# Generate SSL certificate and key
openssl req -x509 -newkey rsa:4096 -keyout ssl/key.pem -out ssl/cert.pem -days 365 -nodes \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"

echo "SSL certificates generated successfully in ssl/ directory"

