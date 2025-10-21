-- Add email parsing fields to credentials table
-- This migration adds support for automatic email detection and parsing

ALTER TABLE credentials
ADD COLUMN is_email BOOLEAN DEFAULT FALSE AFTER password,
ADD COLUMN email_local_part VARCHAR(255) NULL AFTER is_email,
ADD COLUMN email_domain VARCHAR(255) NULL AFTER email_local_part;

-- Add indexes for email searching
CREATE INDEX idx_is_email ON credentials(is_email);
CREATE INDEX idx_email_domain ON credentials(email_domain);
CREATE INDEX idx_email_local_part ON credentials(email_local_part);

-- Update existing records to parse emails from usernames
-- This will identify existing usernames that are emails
UPDATE credentials
SET
  is_email = TRUE,
  email_local_part = SUBSTRING_INDEX(username, '@', 1),
  email_domain = LOWER(SUBSTRING_INDEX(username, '@', -1))
WHERE username LIKE '%@%.%'
  AND CHAR_LENGTH(username) - CHAR_LENGTH(REPLACE(username, '@', '')) = 1;
