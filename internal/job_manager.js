/*
    job_manager.js
    Methods for managing jobs
*/
const superagent = require('superagent');
var is_job_running = false;

//Import Job Handlers
const create_tls_validation_handler = require("./jobs/create_tls_validation_job_handler");

module.exports = function (logger) {

    setInterval(function () { startNextJob(); }, process.env.RUN_NEXT_JOB_INTERVAL);

    //Check if we have a new job to run
    async function startNextJob() {
        if (is_job_running == false) {

            logger.info('Checking new jobs for deployed-client...');
            is_job_running = true;

            //Get all jobs with statuses "new","failed" and find the next job to run
            try {
                const job_res = await superagent.get(process.env.DEPLOYED_CC_SERVER_API_ENDPOINT + `/job/${global.cluster_config.server_id}/status/new,failed`).set({'api_key': global.cluster_config.api_key}).set('accept', 'json');

                //ToDo: finish this manager
                ////////
                const new_jobs = job_res.body;

                if (new_jobs.results.length > 0) {
                    logger.info(`Found ${new_jobs.results.length} new jobs. Checking if we already can run a job from this list...`);

                    //Find the next job to run
                    var job_to_run = null;
                    for (job of new_jobs.results) {
                        const currentDate = new Date();
                        if (job.start_after != undefined && job.start_after > currentDate.getTime()) {
                            //Skip this job, we should run it later 
                            continue;
                        } else {
                            job_to_run = job;
                            break;
                        }
                    }

                    if (job_to_run == null) {
                        logger.info(`No jobs found. All jobs scheduled on later time`);
                        is_job_running = false;
                        return;
                    }

                    //Start the job
                    logger.info(`The job with id: ${job_to_run.objectId} is scheduled`);

                    //ToDo: Check if we have a job with status "in_progress", for example if the service is stopped
                    //ToDo: Add handling multiple tasks simultaneously

                    if (job_to_run.type == "create_tls_validation") {
                        //createTLSVerifyDomainJob(job_to_run);
                    } else {
                        logger.info(`There is no handler for the job with id: ${job_to_run.objectId}. Mark this job as 'cancelled' with a note 'No handler for this type of a job'`);
                        //If we cannot handle a job with this type - just skip this for now
                        await updateJobStatus(job_to_run, "cancelled", "No job handler for this type of a job");
                        is_job_running = false;
                    }
                } else {
                    //There is no a job with
                    logger.info('No new jobs are found');
                    is_job_running = false;
                }
            } catch (err) {
                logger.error('Cannot get jobs, err: ' + err);
                is_job_running = false;
            }
        }
    }

    //Create TLS domain verification job
    async function createTLSVerifyDomainJob(job) {
        try {
            await updateJobStatus(job, "in_progress");
            await create_tls_validation_handler.run(job, logger, jobFinished);
        } catch (error) {
            logger.error(`New exception is catched in createTLSCertificateJob, job_manager.js: ${error}`);
            jobFinished(job, error);
        }
    }

    //Callback which should be called from the "run" function of a job handler
    async function jobFinished(job, error) {
        if (error != null) {
            const currentDate = new Date();
            const next_run_time = currentDate.getTime() + 10 * 1000;
            logger.error(`Cannot finish the job with id: ${job.objectId}, err: ${error}. Schedule next run on ${next_run_time}`);
            await updateJobStatus(job, "failed", error, next_run_time);
        } else {
            await updateJobStatus(job, "done");
        }
        is_job_running = false;
    }

    //Update a job status in DB
    async function updateJobStatus(job, status, notes, next_run_time) {
        var job_update = {};
        if (status) {
            job_update["status"] = status;
        }
        if (notes) {
            job_update["notes"] = JSON.stringify(notes);
        }
        if (next_run_time) {
            job_update["start_after"] = next_run_time;
        }
        try {
            await superagent.put(process.env.DEPLOYED_CC_SERVER_API_ENDPOINT + `/job/` + job.objectId).send(job_update).set({ 'api_key': global.cluster_config.api_key }).set('accept', 'json');
            logger.info(`Status for the job with id: ${job.objectId} is updated from ${job.status} to ${status}`);
        } catch (err) {
            logger.error(`Cannot update the job with id ${job.objectId}, err: ${err}`);
        }
    }

}
