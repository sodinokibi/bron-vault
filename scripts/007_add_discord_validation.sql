-- Add Discord token validation fields
ALTER TABLE discord_tokens
ADD COLUMN is_valid BOOLEAN NULL AFTER source_application,
ADD COLUMN is_validated BOOLEAN DEFAULT FALSE AFTER is_valid,
ADD COLUMN validation_error TEXT NULL AFTER is_validated,
ADD COLUMN global_name VARCHAR(255) NULL AFTER username,
ADD COLUMN avatar VARCHAR(255) NULL AFTER global_name,
ADD COLUMN discriminator VARCHAR(4) NULL AFTER username,
ADD COLUMN email_verified BOOLEAN NULL AFTER email,
ADD COLUMN phone_verified BOOLEAN NULL AFTER phone,
ADD COLUMN premium_type TINYINT NULL COMMENT '0=None, 1=Classic, 2=Nitro, 3=Basic' AFTER mfa_enabled,
ADD COLUMN account_flags INT NULL AFTER premium_type,
ADD COLUMN server_count INT NULL COMMENT 'Number of servers/guilds' AFTER account_flags,
ADD COLUMN friend_count INT NULL COMMENT 'Number of friends' AFTER server_count,
ADD COLUMN account_created TIMESTAMP NULL COMMENT 'Account creation date from snowflake' AFTER friend_count,
ADD COLUMN last_validated TIMESTAMP NULL COMMENT 'Last validation check' AFTER account_created,
ADD COLUMN bio TEXT NULL AFTER last_validated;

-- Add indexes for validation queries
CREATE INDEX idx_is_valid ON discord_tokens(is_valid);
CREATE INDEX idx_is_validated ON discord_tokens(is_validated);
CREATE INDEX idx_premium_type ON discord_tokens(premium_type);
CREATE INDEX idx_last_validated ON discord_tokens(last_validated);

-- Add index for searching by discriminator
CREATE INDEX idx_discriminator ON discord_tokens(discriminator);
CREATE INDEX idx_global_name ON discord_tokens(global_name);
