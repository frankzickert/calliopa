-- The `bunny` channel: the video host a published film's bytes go to
-- (docs/system/publishing.md, The Homepage Destination).
--
-- Homepage stores no video bytes and holds only an id, so a film cannot be
-- published until its bytes are at this host and it has an id from there. The
-- channel is what authenticates that upload.
--
-- Seeded here as the party list is, because the set of channels is application
-- source rather than user data.

insert into connection (party, kind) values ('bunny', 'apiKey');
