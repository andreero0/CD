// Mock for hnswlib-node to avoid native binding issues in tests
module.exports = {
    HierarchicalNSW: class {
        constructor() {}
        initIndex() {}
        addPoint() {}
        searchKnn() {
            return { neighbors: [], distances: [] };
        }
        writeIndexSync() {}
        readIndexSync() {}
    },
};
