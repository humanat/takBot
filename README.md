# README

1.  Install NodeJS and NPM
2.  Clone the repo (<https://github.com/humanat/takBot>)
3.  Run `npm i`
4.  Run `git submodule init && git submodule sync && git submodule update`
5.  Run `pushd TPS-Ninja && npm i && popd`
6.  Run `cp auth.json.template auth.json; cp results.db.template results.db`
7.  Make your own application through Discord (<https://discord.com/developers/applications>)
8.  Copy the token from the Bot page of the Discord portal to your application
9.  Paste the token in `auth.json`
10. Run `node bot` (`Ctrl+C` to end)
11. Invite your bot to your own Discord server by generating an invite link from the OAuth2 page of the Discord portal
    1.  Add redirect URL `https://discordapp.com/oauth2/authorize?&client_id=<ClientID>&scope=bot` with your client ID.
    2.  Select scopes `bot` and `messages.read`
    3.  Select the appropriate permissions
    4.  Press the Copy button in the Scopes section
    5.  Paste into a new browser tab
