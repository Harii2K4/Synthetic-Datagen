"""
file: logger.py
description: Class used for logging and debugging across the project
"""
from __future__ import annotations

import logging
from pathlib import Path


class Logger:
    """A custom logger class that provides file and console logging capabilities.
    
    This class creates a logger that writes to both a file in the 'log' directory
    and to the console. Each logger instance is associated with a specific file name
    and includes custom formatting with file name labels.
    
    Attributes:
        file_name (str): The base name of the file this logger is associated with
        log_dir (Path): The directory where log files are stored
        _logger (logging.Logger): The underlying Python logger instance
    """
    def __init__(self, file_name: str, level: int = logging.INFO) -> None:
        """Initialize the Logger instance.
        
        Args:
            file_name (str): Name of the file to associate with this logger
            level (int): Logging level (default: logging.INFO)
        """
        # Extract just the filename without path
        self.file_name = Path(file_name).name
        # Create log directory if it doesn't exist
        self.log_dir = Path("log")
        self.log_dir.mkdir(parents=True, exist_ok=True)

        # Create the full path for the log file
        log_file_path = self.log_dir / f"{Path(self.file_name).stem}.log"
        # Create a unique logger name based on the filename
        logger_name = f"app_logger.{self.file_name}"

        # Get or create the logger instance
        self._logger = logging.getLogger(logger_name)
        # Set the logging level
        self._logger.setLevel(level)
        # Prevent propagation to avoid duplicate logs
        self._logger.propagate = False

        # Only add handlers if they don't already exist (prevents duplicates)
        if not self._logger.handlers:
            # Create custom formatter with timestamp, level, filename, and message
            formatter = logging.Formatter(
                "%(asctime)s | %(levelname)s | %(filename_label)s | %(message)s"
            )

            # Create and configure file handler
            file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
            file_handler.setFormatter(formatter)
            file_handler.addFilter(self._label_filter())
            self._logger.addHandler(file_handler)

            # Create and configure console/stream handler
            stream_handler = logging.StreamHandler()
            stream_handler.setFormatter(formatter)
            stream_handler.addFilter(self._label_filter())
            self._logger.addHandler(stream_handler)

    def _label_filter(self) -> logging.Filter:
        """Create a custom filter that adds the filename to log records.
        
        This filter adds a 'filename_label' attribute to each log record,
        which is used in the formatter to show which file generated the log.
        
        Returns:
            logging.Filter: A custom filter instance
        """
        file_name = self.file_name

        class _FileNameFilter(logging.Filter):
            """Inner class that implements the actual filtering logic."""
            def filter(self, record: logging.LogRecord) -> bool:
                """Add filename label to the log record.
                
                Args:
                    record (logging.LogRecord): The log record to filter
                    
                Returns:
                    bool: Always True to allow all records through
                """
                # Add the filename as a custom attribute
                record.filename_label = file_name
                return True

        return _FileNameFilter()

    def debug(self, message: str) -> None:
        """Log a debug message.
        
        Args:
            message (str): The message to log
        """
        self._logger.debug(message)

    def info(self, message: str) -> None:
        """Log an info message.
        
        Args:
            message (str): The message to log
        """
        self._logger.info(message)

    def warning(self, message: str) -> None:
        """Log a warning message.
        
        Args:
            message (str): The message to log
        """
        self._logger.warning(message)

    def error(self, message: str) -> None:
        """Log an error message.
        
        Args:
            message (str): The message to log
        """
        self._logger.error(message)

    def critical(self, message: str) -> None:
        """Log a critical message.
        
        Args:
            message (str): The message to log
        """
        self._logger.critical(message)

    @property
    def instance(self) -> logging.Logger:
        """Get the underlying Python logger instance.
        
        This property provides access to the raw logging.Logger instance
        for advanced use cases or direct manipulation.
        
        Returns:
            logging.Logger: The underlying logger instance
        """
        return self._logger
