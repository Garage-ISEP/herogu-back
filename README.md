# Herogu backend

## Project deployment
All deployments are located in : [config/](config/)
* The PHP folders holds all the configuration to run with PHP-FPM and nginx
* The [php.ini file](config/php/php.ini) contains the vars that will be substituted by docker's env vars 

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
* The PHP dynamic Dockerfile will use a base image generated and store on the garageisep repositories from the following Dockerfile : [config/php/Dockerfile.base](config/php/Dockerfile.base)