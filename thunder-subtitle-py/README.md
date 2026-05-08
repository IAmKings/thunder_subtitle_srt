# Thunder Subtitle

CLI tool for searching and downloading Chinese subtitles via Xunlei API.

## Install

```bash
pip install -e .
```

Or from source:

```bash
git clone <repo>
pip install .
```

## Usage

```bash
# Search subtitles
thunder-subtitle search "Movie Name"

# Download all subtitles for a movie
thunder-subtitle dump "Movie Name"

# Scan Jellyfin directory for missing subtitles
thunder-subtitle scan /path/to/media

# Review downloaded subtitles
thunder-subtitle review /path/to/media
```

## Requirements

- Python >= 3.10
- `requests`
