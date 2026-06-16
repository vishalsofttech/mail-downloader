const Pop3Command = require('node-pop3');
require('dotenv').config();

async function test() {
    const pop3 = new Pop3Command({
        user: process.env.REDIFFMAIL_USERNAME,
        password: process.env.REDIFFMAIL_PASSWORD,
        host: process.env.REDIFFMAIL_HOST,
        port: parseInt(process.env.REDIFFMAIL_PORT, 10),
        tls: process.env.REDIFFMAIL_TLS === 'true'
    });

    try {
        const stat = await pop3.STAT();
        console.log('STAT:', stat);
        
        const list = await pop3.LIST();
        console.log('LIST length:', list.length);
        if (list.length > 0) console.log('LIST[0]:', list[0]);

        const uidl = await pop3.UIDL();
        console.log('UIDL length:', uidl.length);
        if (uidl.length > 0) console.log('UIDL[0]:', uidl[0]);
        
    } catch (err) {
        console.error('Error:', err);
    } finally {
        await pop3.QUIT();
    }
}

test();
