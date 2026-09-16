CREATE DATABASE IF NOT EXISTS file_manager;
CREATE USER IF NOT EXISTS 'file_manager'@'localhost' IDENTIFIED BY 'change-me';
GRANT ALL PRIVILEGES ON file_manager.* TO 'file_manager'@'localhost';
FLUSH PRIVILEGES;
