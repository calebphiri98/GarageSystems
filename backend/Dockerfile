FROM php:8.2-apache

# Enable the Postgres PDO driver and Apache's rewrite module (needed for .htaccess routing)
RUN apt-get update && apt-get install -y libpq-dev \
    && docker-php-ext-install pdo pdo_pgsql \
    && a2enmod rewrite \
    && rm -rf /var/lib/apt/lists/*

# Apache's default docroot is /var/www/html - copy our backend there
COPY . /var/www/html/

# Allow .htaccess overrides (Apache disables this by default)
RUN { \
    echo '<Directory /var/www/html>'; \
    echo '    AllowOverride All'; \
    echo '    Require all granted'; \
    echo '</Directory>'; \
    } > /etc/apache2/conf-available/allow-override.conf \
    && a2enconf allow-override

# Render injects a PORT env var at container start (usually 10000) and routes
# external traffic to it - Apache must be told to listen on that exact port,
# and this has to happen at container START (not image build), since the
# value isn't known until Render actually runs the container.
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 8080
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["apache2-foreground"]
