export const MAX_ATTEMPTS = 10;
export const RETRY_TIMEOUT = 2000;

type AsyncFunc = (...args: any[]) => Promise<any>;

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetries(f: AsyncFunc, ...args: any[]) {
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        try {
            return await f(...args);
        } catch (e) {
            if (i === MAX_ATTEMPTS - 1) throw e;

            console.log(`Failed with error: ${e}. Retry in ${RETRY_TIMEOUT / 1000}s.`);
            await sleep(RETRY_TIMEOUT);
        }
    }
}
