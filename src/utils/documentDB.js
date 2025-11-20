/**
 * IndexedDB utility for managing document storage
 * Stores document metadata, content, and chunks for RAG system
 */

const DB_NAME = 'CheatingDaddyDocuments';
const DB_VERSION = 1;
const STORE_NAME = 'documents';

class DocumentDB {
    constructor() {
        this.db = null;
    }

    /**
     * Initialize the database
     * @returns {Promise<IDBDatabase>}
     */
    async init() {
        if (this.db) {
            return this.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                reject(new Error('Failed to open database'));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = event => {
                const db = event.target.result;

                // Create documents store if it doesn't exist
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, {
                        keyPath: 'id',
                        autoIncrement: true,
                    });

                    // Create indexes
                    objectStore.createIndex('fileName', 'fileName', { unique: false });
                    objectStore.createIndex('uploadDate', 'uploadDate', { unique: false });
                    objectStore.createIndex('type', 'type', { unique: false });
                }
            };
        });
    }

    /**
     * Add a new document to the database
     * @param {Object} document - Document object with metadata and content
     * @returns {Promise<number>} Document ID
     */
    async addDocument(document) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            const documentData = {
                ...document,
                uploadDate: new Date().toISOString(),
            };

            const request = store.add(documentData);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(new Error('Failed to add document'));
            };
        });
    }

    /**
     * Get all documents
     * @returns {Promise<Array>}
     */
    async getAllDocuments() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = () => {
                resolve(request.result || []);
            };

            request.onerror = () => {
                reject(new Error('Failed to get documents'));
            };
        });
    }

    /**
     * Get a document by ID
     * @param {number} id - Document ID
     * @returns {Promise<Object|null>}
     */
    async getDocument(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result || null);
            };

            request.onerror = () => {
                reject(new Error('Failed to get document'));
            };
        });
    }

    /**
     * Delete a document by ID
     * @param {number} id - Document ID
     * @returns {Promise<void>}
     */
    async deleteDocument(id) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to delete document'));
            };
        });
    }

    /**
     * Update a document
     * @param {number} id - Document ID
     * @param {Object} updates - Updates to apply
     * @returns {Promise<void>}
     */
    async updateDocument(id, updates) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const getRequest = store.get(id);

            getRequest.onsuccess = () => {
                const document = getRequest.result;
                if (!document) {
                    reject(new Error('Document not found'));
                    return;
                }

                const updatedDocument = { ...document, ...updates };
                const putRequest = store.put(updatedDocument);

                putRequest.onsuccess = () => {
                    resolve();
                };

                putRequest.onerror = () => {
                    reject(new Error('Failed to update document'));
                };
            };

            getRequest.onerror = () => {
                reject(new Error('Failed to get document for update'));
            };
        });
    }

    /**
     * Clear all documents
     * @returns {Promise<void>}
     */
    async clearAll() {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(new Error('Failed to clear documents'));
            };
        });
    }
}

// Export singleton instance
export const documentDB = new DocumentDB();
