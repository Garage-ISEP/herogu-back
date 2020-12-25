FROM php:8-apache

RUN apt-get update -y

RUN docker-php-ext-install -j$(nproc) pdo pdo_mysql

COPY conf/php.ini /etc/php/php.ini

LABEL ORIGIN="garage"

EXPOSE 80