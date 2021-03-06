const path = require('path');
let logger = require('perfect-logger');
const express = require('express');
let instance = require('./EC2Instance');
let system = require('./WebSystem');

logger.addStatusCode('ec2', 'EC2', 2);
logger.addStatusCode('web', 'WEB', 2);
logger.initialize('LaunchPad', {
    logLevelFile: 0,                    // Log level for file
    logLevelConsole: 4,                 // Log level for STDOUT/STDERR
    logDirectory: 'logs/',              // Log directory
    timezone: 'Asia/Colombo',
    developmentMode: true
});

let bootSequenceOnProgress = false;
let bootState = 0;

async function boot() {
    if (bootSequenceOnProgress)
    {
        return;
    }

    try {
        bootSequenceOnProgress = true;
        bootState = 1;
        logger.info("Starting EC2");
        let response = await instance.startInstance();
        logger.info("EC2 Started");
        logger.info("Waiting for Web System");
        bootState = 2;
        await system.wait(20);
        logger.info("Web System Online");
        bootSequenceOnProgress = false;
        bootState = 3;
    } catch (e) {
        logger.crit("Error occurred during boot sequence", e);
        bootState = -1;
        bootSequenceOnProgress = false;
    }
}

const app = express();
const port = process.env.PORT || 3000;

app.engine('html', require('ejs').renderFile);
app.set('views', __dirname + '/');
app.use('/public',express.static(path.join(__dirname, 'public')));
// app.use('/cdn',express.static(path.join(__dirname, 'node_modules')));

app.get('/', async (req, res) => {
    logger.debug('Request received');
    let alive = false;
    if (!bootSequenceOnProgress){
        alive = await system.IsAlive(2500);
    }
    if (alive){
        logger.debug('Request redirected as system is LIVE');
        res.writeHead(302, {
            'Location': process.env.REDIRECT_URL
        });
        res.end();
        return;
    }
    logger.debug('Running boot sequence');
    boot();
    res.render('public/index.ejs', {indexNumber: 0});
});

app.get('/state', async (req, res) => {
    res.send({
        state: bootState,
        url: process.env.REDIRECT_URL
    });
});

app.get('/:indexNumber',async function (req,res) {
    let indexNumber = parseInt(req.params['indexNumber']) || 0;
    logger.debug('Public profile request received: ' + indexNumber);
    let alive = false;
    if (!bootSequenceOnProgress){
        alive = await system.IsAlive(2500);
    }
    if (alive){
        logger.debug('Request redirected as system is LIVE');
        res.writeHead(302, {
            'Location': process.env.REDIRECT_URL  + `#!/public-profile/${indexNumber}`
        });
        res.end();
        return;
    }
    logger.debug('Running boot sequence');
    boot();
    res.render('public/index.ejs', {indexNumber: indexNumber});
});

app.listen(port, () => {
    logger.info(`Server running on port #${port}`);
});
