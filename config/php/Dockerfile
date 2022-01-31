FROM ghcr.io/garageisep/herogu-php-base:8.1.2

COPY ./config/php.ini /etc/php/php.ini
COPY ./config/nginx.conf /etc/nginx/nginx.conf

COPY . /var/www/html
RUN chown -R www-data:www-data /var/www/html

LABEL ORIGIN herogu.garageisep.com

EXPOSE 80