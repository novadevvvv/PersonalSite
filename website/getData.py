from pathlib import Path

PROJECTS_FILE = Path(__file__).with_name("projects.json")


def main() -> None:
    if not PROJECTS_FILE.exists():
        raise SystemExit("projects.json was not found.")

    print("Live project collection is disabled.")
    print(f"Using static snapshot: {PROJECTS_FILE}")


if __name__ == "__main__":
    main()