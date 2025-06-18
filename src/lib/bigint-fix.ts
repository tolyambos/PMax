// Global BigInt serialization fix
declare global {
  interface BigInt {
    toJSON(): string;
  }
}

// Add toJSON method to BigInt prototype for automatic JSON serialization
BigInt.prototype.toJSON = function () {
  return this.toString();
};

export {};
