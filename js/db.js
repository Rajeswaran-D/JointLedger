const DB_NAME = 'JointLedgerLiteDB';
const DB_VERSION = 1;

const db = {
    _db: null,
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            
            request.onerror = (e) => reject('IndexedDB error: ' + e.target.errorCode);
            
            request.onsuccess = (e) => {
                this._db = e.target.result;
                resolve();
            };
            
            request.onupgradeneeded = (e) => {
                const dbInstance = e.target.result;
                
                if (!dbInstance.objectStoreNames.contains('members')) {
                    dbInstance.createObjectStore('members', { keyPath: 'id' });
                }
                
                if (!dbInstance.objectStoreNames.contains('transactions')) {
                    const txStore = dbInstance.createObjectStore('transactions', { keyPath: 'id', autoIncrement: true });
                    txStore.createIndex('memberId', 'memberId', { unique: false });
                    txStore.createIndex('date', 'date', { unique: false });
                }
            };
        });
    },

    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    },

    async put(storeName, item) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(item);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    async delete(storeName, id) {
        return new Promise((resolve, reject) => {
            const transaction = this._db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(id);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
};
