const fetch = require('node-fetch');
let logger = require('perfect-logger');

async function isAlive() {
    logger.web(`Checking for web system`);
    return new Promise((resolve, reject)=>{
        fetch(process.env.LIVNESS_PROBE_URL, {timeout: 5000})
            .then(res => {
                if (res.ok)
                {
                    logger.web(`Web system ONLINE`);
                    resolve(true)
                }
                else
                {
                    logger.web(`Web system OFFLINE: STATUS_UNKNOWN`);
                    resolve(false)
                }
            })
            .catch(err => {
                logger.web(`Web system OFFLINE: CONNECTION_ERROR`);
                resolve(false)
            })
    })
}

exports.IsAlive = isAlive;

exports.wait = async function f(timeout) {
    return new Promise((resolve, reject) => {
        let count = 1;
        const timeoutTimer = setInterval(async ()=>{
            const alive = await isAlive();
            if (alive === true) {
                clearInterval(timeoutTimer);
                resolve(true);
            }

            if (count > timeout) {
                clearInterval(timeoutTimer);
                reject(false);
            }
        }, 5500)

    })
};
