const Pop3Command = require('node-pop3');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Configuration
const user = process.env.REDIFFMAIL_USERNAME;
const password = process.env.REDIFFMAIL_PASSWORD;
const host = process.env.REDIFFMAIL_HOST;
const port = parseInt(process.env.REDIFFMAIL_PORT, 10);
const tls = process.env.REDIFFMAIL_TLS === 'true';
const timeout = 120000; // 2 minutes timeout to prevent premature drops

async function downloadMails() {
    console.log(`Starting email download for ${user}...`);

    // Extract domain for folder structure
    const parts = user.split('@');
    if (parts.length !== 2) {
        console.error("Error: Invalid email format in REDIFFMAIL_USERNAME");
        process.exit(1);
    }
    const domain = parts[1];

    // Create target directory: domain/user
    const targetDir = path.join(__dirname, domain, user);
    await fs.promises.mkdir(targetDir, { recursive: true });
    console.log(`Target directory initialized: ${targetDir}`);

    const pop3 = new Pop3Command({ user, password, host, port, tls, timeout });

    try {
        console.log("Connecting and fetching message list (UIDL)...");
        const uidls = await pop3.UIDL();
        console.log(`Total messages on server: ${uidls.length}`);

        let downloadedCount = 0;
        let skippedCount = 0;

        // Process sequentially to keep memory usage low
        for (let i = 0; i < uidls.length; i++) {
            const [msgNum, uid] = uidls[i];

            // Clean up the UID string to be a valid filename
            const safeUid = uid.replace(/[^a-zA-Z0-9.-]/g, '_');
            const filePath = path.join(targetDir, `${safeUid}.eml`);

            try {
                // Check if file already exists to resume interrupted downloads
                await fs.promises.access(filePath);
                skippedCount++;

                // Print periodic progress for skipped items
                if (skippedCount % 1000 === 0) {
                    console.log(`... Skipped ${skippedCount} messages (already downloaded).`);
                }
                continue;
            } catch (err) {
                // File does not exist, proceed to download
            }

            console.log(`[${i + 1}/${uidls.length}] Downloading message ID: ${uid} ...`);

            try {
                // Fetch the entire raw message string
                const rawMessage = await pop3.RETR(msgNum);

                // Save to file asynchronously to keep event loop unblocked
                await fs.promises.writeFile(filePath, rawMessage, 'utf8');
                downloadedCount++;
            } catch (downloadError) {
                console.error(`Failed to download message ${msgNum} (UID: ${uid}):`, downloadError.message);
                // We choose to continue to the next email instead of crashing the whole process
                // This makes it resilient against a single corrupted/bad email
            }
        }

        console.log(`\n--- Summary ---`);
        console.log(`Total newly downloaded: ${downloadedCount}`);
        console.log(`Total skipped (already exist): ${skippedCount}`);
        console.log(`Total failed: ${uidls.length - downloadedCount - skippedCount}`);

    } catch (err) {
        console.error("\n[!] A fatal error occurred during POP3 operations:", err);
        console.log("You can safely restart the script; it will resume where it left off.");
    } finally {
        try {
            await pop3.QUIT();
            console.log("Cleanly disconnected from server.");
        } catch (quitErr) {
            console.log("Connection closed abruptly.");
        }
    }
}

downloadMails();
