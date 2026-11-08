"""Existing application records gain a nullable interview time without data loss."""

from pathlib import Path

from app.db_engine import init_models_sync, make_sync_engine


def test_interview_time_migration_is_idempotent(tmp_path: Path) -> None:
    engine = make_sync_engine(tmp_path / "legacy.db")
    try:
        with engine.begin() as connection:
            connection.exec_driver_sql(
                """
                CREATE TABLE applications (
                    application_id TEXT PRIMARY KEY,
                    job_id TEXT NOT NULL,
                    resume_id TEXT NOT NULL,
                    status TEXT NOT NULL
                )
                """
            )
            connection.exec_driver_sql(
                "INSERT INTO applications VALUES ('a1', 'j1', 'r1', 'interview')"
            )

        init_models_sync(engine)
        init_models_sync(engine)

        with engine.begin() as connection:
            columns = [
                column["name"]
                for column in connection.exec_driver_sql(
                    "PRAGMA table_info(applications)"
                ).mappings()
            ]
            interview_at = connection.exec_driver_sql(
                "SELECT interview_at FROM applications WHERE application_id = 'a1'"
            ).scalar_one()
        assert columns.count("interview_at") == 1
        assert interview_at is None
    finally:
        engine.dispose()
