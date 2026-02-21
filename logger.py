"""
file: logger.py
description: Class used for logging and debugging across the project
"""
from __future__ import annotations

import logging
from pathlib import Path


class Logger:
    def __init__(self, file_name: str, level: int = logging.INFO) -> None:
        self.file_name = Path(file_name).name
        self.log_dir = Path("log")
        self.log_dir.mkdir(parents=True, exist_ok=True)

        log_file_path = self.log_dir / f"{Path(self.file_name).stem}.log"
        logger_name = f"app_logger.{self.file_name}"

        self._logger = logging.getLogger(logger_name)
        self._logger.setLevel(level)
        self._logger.propagate = False

        if not self._logger.handlers:
            formatter = logging.Formatter(
                "%(asctime)s | %(levelname)s | %(filename_label)s | %(message)s"
            )

            file_handler = logging.FileHandler(log_file_path, encoding="utf-8")
            file_handler.setFormatter(formatter)
            file_handler.addFilter(self._label_filter())
            self._logger.addHandler(file_handler)

            stream_handler = logging.StreamHandler()
            stream_handler.setFormatter(formatter)
            stream_handler.addFilter(self._label_filter())
            self._logger.addHandler(stream_handler)

    def _label_filter(self) -> logging.Filter:
        file_name = self.file_name

        class _FileNameFilter(logging.Filter):
            def filter(self, record: logging.LogRecord) -> bool:
                record.filename_label = file_name
                return True

        return _FileNameFilter()

    def debug(self, message: str) -> None:
        self._logger.debug(message)

    def info(self, message: str) -> None:
        self._logger.info(message)

    def warning(self, message: str) -> None:
        self._logger.warning(message)

    def error(self, message: str) -> None:
        self._logger.error(message)

    def critical(self, message: str) -> None:
        self._logger.critical(message)

    @property
    def instance(self) -> logging.Logger:
        return self._logger
