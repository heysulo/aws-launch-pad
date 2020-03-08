const AWS = require('aws-sdk');
let logger = require('perfect-logger');

AWS.config.region = 'ap-southeast-1';
const ec2 = new AWS.EC2({apiVersion: '2016-11-15'});

const param = {
    InstanceIds: [
        "i-0e9bae3f994a49647"
    ]
};

const EC2_STATUS_CODES = Object.freeze(
    {"UNKNOWN": -1, "PENDING":0,"RUNNING":16,"SHUTTING_DOWN":32,"TERMINATED":48,"STOPPING":64,"STOPPED":80});

exports.EC2_STATUS_CODES = EC2_STATUS_CODES;


function getStatusCodeName(statusCode) {
    let returnKey = `UNKNOWN_STATUS_CODE:${statusCode}`;
    Object.keys(EC2_STATUS_CODES).forEach((key)=>{
        if (EC2_STATUS_CODES[key] === statusCode) {
            returnKey = key;
        }
    });

    return returnKey;
}

async function waitForInstanceState (expectedState, timeout) {
    logger.ec2(`Waiting for instance to reach state: ${getStatusCodeName(expectedState)}`);
    return new Promise((resolve, reject)=>{
        let count = 1;
        const timeoutTimer = setInterval(()=>{
            ec2.describeInstanceStatus(Object.assign({ IncludeAllInstances: true }, param), (err, data)=> {
                if (err)
                {
                    clearInterval(timeoutTimer);
                    logger.crit(`Error occurred while waiting for instance to reach state: ${getStatusCodeName(expectedState)}`, err);
                    reject(err);
                }
                else
                {
                    if (data.InstanceStatuses.length)
                    {
                        if (data.InstanceStatuses[0].InstanceState.Code === expectedState)
                        {
                            clearInterval(timeoutTimer);
                            logger.ec2(`Instance has reached the state: ${getStatusCodeName(expectedState)}`, data);
                            resolve(data);
                        }
                        else
                        {
                            logger.ec2(`[${count}/${timeout}] Waiting for instance to reach state: ${getStatusCodeName(expectedState)} from ${getStatusCodeName(data.InstanceStatuses[0].InstanceState.Code)}`);
                        }
                    }
                    else
                    {
                        logger.ec2(`[${count}/${timeout}] Waiting for instance to reach state: ${getStatusCodeName(expectedState)}. NO_DATA`);
                    }
                }

                if (count > timeout) {
                    clearInterval(timeoutTimer);
                    logger.ec2(`Timeout reached. Instance did not reach state: ${getStatusCodeName(expectedState)}`);
                    reject(new Error("Timeout"))
                }
                count += 1;
            });
        }, 1000);
    });
}

exports.startInstance = async function () {
    return new Promise(async (resolve, reject)=>{
        logger.ec2('Starting Instance');
        ec2.startInstances(param, function(err, data) {
            if (err) {
                logger.crit('Error occurred starting instance', err);
                reject(err);
            }
            else
            {
                waitForInstanceState(EC2_STATUS_CODES.RUNNING, 60)
                    .then((d)=> resolve(d))
                    .catch((e)=> reject(e))
            }
        });
    })
};

exports.stopInstance = async function () {
    return new Promise(async (resolve, reject)=>{
        logger.ec2('Stopping Instance');
        ec2.stopInstances(param, function(err, data) {
            if (err) {
                logger.crit('Error occurred stopping instance', err);
                reject(err);
            }
            else
            {
                waitForInstanceState(EC2_STATUS_CODES.STOPPED, 60)
                    .then((d)=> resolve(d))
                    .catch((e)=> reject(e))
            }
        });
    })
};

exports.waitForInstanceState =  waitForInstanceState;

exports.getCurrentState = async function () {
    return new Promise((resolve, reject)=> {
        ec2.describeInstanceStatus(Object.assign({ IncludeAllInstances: true }, param), (err, data)=> {
            if (!err && data.InstanceStatuses.length)
            {
                resolve(data.InstanceStatuses[0].InstanceState.Code);
                return;
            }

            resolve(EC2_STATUS_CODES.UNKNOWN);
        })
    });

};