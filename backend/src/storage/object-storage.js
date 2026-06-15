export class ObjectStorage {
  async createUploadUrl() {
    throw new Error("createUploadUrl is not implemented");
  }

  async createDownloadUrl() {
    throw new Error("createDownloadUrl is not implemented");
  }

  async statObject() {
    throw new Error("statObject is not implemented");
  }

  async readObjectBytes() {
    throw new Error("readObjectBytes is not implemented");
  }

  async deleteObject() {
    throw new Error("deleteObject is not implemented");
  }
}
