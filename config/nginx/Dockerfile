FROM nginx:1.21.6-alpine

LABEL maintainer="theodore.prevot@garageisep.com" \
	org.label-schema.name="alpine" \
	org.label-schema.vendor="GarageISEP" \
	org.label-schema.version="8.1.2" \
	org.label-schema.description="Docker Alpine image with Nginx for Herogu systems" \
	org.label-schema.license="MIT" \
	ORIGIN=herogu.garageisep.com

COPY ./docker/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

LABEL ORIGIN herogu.garageisep.com

COPY . /var/www/html