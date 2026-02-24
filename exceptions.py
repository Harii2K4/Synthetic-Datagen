"""
file:expections.py
description:Contains the custom exceptions used in the project
"""
class TeacherPromptError(Exception):
    """Raised when teacher prompt loading fails."""
    pass
class TeacherPromptNotFoundError(TeacherPromptError):
    """Raised when specific teacher template doesn't exist."""
    pass

class GenerationModelNotFoundError(ValueError):
    """Raised when generation model loading fails."""
    pass
class TeacherModelNotFoundError(ValueError):
    """Raised when generation model loading fails."""
    pass
