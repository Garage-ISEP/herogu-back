FROM php:8-apache

RUN apt-get update -y && apt-get install -y libonig-dev

RUN docker-php-ext-install -j$(nproc) pdo pdo_mysql mbstring mysqli exif && docker-php-ext-enable mysqli

RUN a2enmod rewrite
RUN a2disconf serve-cgi-bin

COPY php.ini /etc/php/php.ini

LABEL ORIGIN="garage"

EXPOSE 80