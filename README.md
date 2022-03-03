# Herogu backend

## Project deployment
All deployments are located in : [config/](config/)
* The PHP folders holds all the configuration to run with PHP-FPM and nginx
* The [php.ini file](config/php/php.ini) contains vars that will be substituted by docker's env vars :

PHP_ERROR_REPORTING : 
```ini
; Common Values:
;   E_ALL (Show all errors, warnings and notices including coding standards.)
;   E_ALL & ~E_NOTICE  (Show all errors, except for notices)
;   E_ALL & ~E_NOTICE & ~E_STRICT  (Show all errors, except for notices and coding standards warnings.)
;   E_COMPILE_ERROR|E_RECOVERABLE_ERROR|E_ERROR|E_CORE_ERROR  (Show only errors)
; Default Value: E_ALL & ~E_NOTICE & ~E_STRICT & ~E_DEPRECATED
; Development Value: E_ALL
; Production Value: E_ALL & ~E_DEPRECATED & ~E_STRICT
; http://php.net/error-reporting
error_reporting = ${PHP_ERROR_REPORTING}
```

PHP_DISPLAY_ERROR :
```ini
; This directive controls whether or not and where PHP will output errors,
; notices and warnings too. Error output is very useful during development, but
; it could be very dangerous in production environments. Depending on the code
; which is triggering the error, sensitive information could potentially leak
; out of your application such as database usernames and passwords or worse.
; It's recommended that errors be logged on production servers rather than
; having the errors sent to STDOUT.
; Possible Values:
;   Off = Do not display any errors 
;   stderr = Display errors to STDERR (affects only CGI/CLI binaries!)   
;   On or stdout = Display errors to STDOUT
; Default Value: On
; Development Value: On
; Production Value: Off
; http://php.net/display-errors
display_errors = ${PHP_DISPLAY_ERROR}
```
* All the nginx configurations use the env variable `PROJECT_ROOT` that will be substituted when generating all the config files in the repository
* The PHP dynamic Dockerfile will use a base image generated and stored on the garageisep repositories from the following Dockerfile : [config/php/Dockerfile.base](config/php/Dockerfile.base)

## Authentication
User authentication is made with the SSO service of ISEP. Thanks to that, students can login with their school creds easily. [See corresponding service](src/services/sso.service.ts).
Password are not stored from our side, we only keep:
 * Firstname Name
 * Student Mail Adress
 * Graduating year
 * Student ID

## Mailing
Mail service is using Google Suite services to send mails to students. [See corresponding service](src/services/mailer.service.ts).

## Github
Github service allows Herogu to interact with a Github App and the repositories where the App is on. [See correspondig service](src/services/github.service.ts).

Thanks to this bot we can then:
 * Upload config files to a project repository
 * Verify config integrity
 * Receive webhooks when someone pushes on the main/master branch

## Docker
Docker service allows Herogu to interact with the Docker api to manage all containers and images (creation, updates, deletion, ...). [See corresponding service](src/services/docker.service.ts)

## Mysql
Mysql service allow Herogu to manage projects mysql databases through docker sock. [See corresponding service](src/services/mysql.service.ts)

## Storage
Storage service watch the container storage use. [See corresponding service](src/services/storage.service.ts)
 * If the container uses more than 90% of the limit defined in the env vars an alert will be sent by email.
 * If the container uses more than 100% of the limit defined in the env vars a timeout of 48h will be enabled and another alert will be sent. After these 48h if it is not under 100% of the limit the project is reset.
 * If the container uses more than 150% of the limit it will be instantly reset.

## Container configuration
Configuration service execute commands in project container to update configurations without recreating the container. [See corresponding service](src/services/config.service.ts). It can:
 * Update PHP log level or totally disable logs
 * Update Nginx http root path in project