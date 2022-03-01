FROM ghcr.io/garage-isep/herogu-back/herogu-php-base

COPY ./docker/nginx.conf /etc/nginx/nginx.conf

COPY . /var/www/html

RUN chown -R nginx:www-data /var/www/html
RUN chmod -R 777 /var/www/html

LABEL ORIGIN herogu.garageisep.com

EXPOSE 80