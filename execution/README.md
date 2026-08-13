# Execution Scripts

Deterministic Python scripts that do the actual work.

Guidelines:
- Each script should be **single-purpose** and **well-commented**
- Load configuration from `.env` (use `python-dotenv`)
- Write intermediate outputs to `.tmp/`
- Deliver final outputs to cloud services (Google Sheets, Slides, etc.)
- Handle errors gracefully with clear error messages
- Be testable independently from the command line
