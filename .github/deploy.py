#!/usr/bin/env python3
import os
import sys
import ftplib
import time

FTP_HOST = os.environ.get("FTP_HOST", "site104851.siteasp.net")
FTP_USER = os.environ.get("FTP_USER", "site104851")
FTP_PASS = os.environ.get("FTP_PASS", "")
LOCAL_DIR = os.environ.get("LOCAL_DIR", "./publish")
REMOTE_DIR = os.environ.get("REMOTE_DIR", "/wwwroot")

def get_ftp():
    print(f"Connecting to FTP server {FTP_HOST}...")
    ftp = ftplib.FTP(timeout=60)
    ftp.connect(FTP_HOST, 21)
    ftp.login(FTP_USER, FTP_PASS)
    ftp.set_pasv(True)
    print("FTP Connected successfully.")
    return ftp

def ensure_remote_dir(ftp, dir_path):
    parts = [p for p in dir_path.replace("\\", "/").split("/") if p]
    current = ""
    for part in parts:
        current += "/" + part
        try:
            ftp.cwd(current)
        except Exception:
            try:
                ftp.mkd(current)
                ftp.cwd(current)
            except Exception:
                pass

def upload_directory(ftp, local_base, remote_base):
    ensure_remote_dir(ftp, remote_base)
    uploaded = 0
    skipped = 0

    for root, dirs, files in os.walk(local_base):
        rel_path = os.path.relpath(root, local_base)
        if rel_path == ".":
            target_remote_dir = remote_base
        else:
            target_remote_dir = remote_base + "/" + rel_path.replace("\\", "/")

        ensure_remote_dir(ftp, target_remote_dir)

        # Get existing remote files and sizes
        remote_sizes = {}
        try:
            lines = []
            ftp.retrlines("LIST", lines.append)
            for line in lines:
                parts = line.split()
                if len(parts) >= 9:
                    fname = " ".join(parts[8:])
                    try:
                        remote_sizes[fname] = int(parts[4])
                    except (ValueError, IndexError):
                        pass
        except Exception:
            pass

        for file in files:
            local_file_path = os.path.join(root, file)
            local_size = os.path.getsize(local_file_path)

            # Check if unchanged (same size and not config file)
            is_config = file in ["web.config", "appsettings.json", "appsettings.Production.json", "index.html"]
            if not is_config and file in remote_sizes and remote_sizes[file] == local_size:
                skipped += 1
                continue

            # Upload file with retry
            uploaded_file = False
            for attempt in range(1, 4):
                try:
                    with open(local_file_path, "rb") as fp:
                        ftp.storbinary(f"STOR {file}", fp)
                    uploaded_file = True
                    uploaded += 1
                    break
                except Exception as ex:
                    print(f"Warning: upload failed for {file} (attempt {attempt}/3): {ex}")
                    time.sleep(2)
                    try:
                        ftp = get_ftp()
                        ftp.cwd(target_remote_dir)
                    except Exception:
                        pass

            if not uploaded_file:
                print(f"Error: failed to upload {local_file_path} after 3 attempts.")
                sys.exit(1)

    print(f"\nDeployment Complete! Uploaded: {uploaded} files, Skipped (unchanged): {skipped} files.")

def main():
    if not FTP_PASS:
        print("Error: FTP_PASS environment variable is required.")
        sys.exit(1)

    ftp = get_ftp()
    try:
        upload_directory(ftp, LOCAL_DIR, REMOTE_DIR)
    finally:
        try:
            ftp.quit()
        except Exception:
            pass

if __name__ == "__main__":
    main()
