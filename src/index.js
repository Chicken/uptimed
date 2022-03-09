import bent from "bent";
import si from "systeminformation";
import pm2 from "pm2";
import cron from "node-cron";
import { readFile } from "fs/promises";
import { promisify } from "util";

const pm2p = f => promisify(f).bind(pm2);
pm2p(pm2.connect)();

const config = JSON.parse(await readFile("./config.json", "utf-8"));

if (
    !Array.isArray(config)
    || config.some((target) =>
        Object.keys(target).sort().toString() !== 'name,push,type'
        || typeof target.name !== "string"
        || target.name.length === 0
        || !["docker", "pm2"].includes(target.type)
        || typeof target.push !== "string"
        || target.push.length === 0)
) {
    console.error("Invalid configuration");
    process.exit(1);
}

cron.schedule("* * * * *", async () => {
    const containers = await si.dockerContainers(true);
    const pm2processes = await pm2p(pm2.list)();
    for (const { type, name, push } of config) {
        if (type === "docker") {
            const container = containers.find(c => c.name === name);
            if (container && container.state !== "exited")
                bent("GET")(`${push}?msg=OK`).catch(console.error);
        } else if (type === "pm2") {
            const process = pm2processes.find(p => p.name === name);
            if (process && !["stopped", "errored"].includes(process.pm2_env.status))
                bent("GET")(`${push}?msg=OK`).catch(console.error);
        }
    }
});
