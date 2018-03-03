/**
 * Retry Promise
 * @param {number} retries
 * @param {() => Promise<T>} callback
 * @returns {Promise<T>}
 */
export async function retry<T>(retries: number, callback: (() => Promise<T>)): Promise<T> {
  let error: any = new Error("Failed after " + retries + " retries");
  for (let i = 0; i < retries; i++) {
    try {
      return await callback();
    } catch (e) {
      error = e;
    }
  }
  throw error;
}
