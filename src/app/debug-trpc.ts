// Simple debugging module for tRPC
export const debugTRPC = {
  // Log the input being passed to tRPC
  logInput: (input: any) => {
    console.log("🔍 tRPC Input Debug:");
    console.log("- Input type:", typeof input);
    console.log("- Input value:", input);

    if (input === null || input === undefined) {
      console.warn("⚠️ Input is null or undefined!");
      return null;
    }

    if (typeof input === "object") {
      console.log("- Input keys:", Object.keys(input));

      if ("id" in input) {
        console.log("- ID value:", input.id);
        console.log("- ID type:", typeof input.id);
        console.log("- ID length:", input.id?.length);
      } else {
        console.warn("⚠️ No id property in input object!");
      }
    }

    return input;
  },
};
