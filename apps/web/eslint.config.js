import reactConfig from "@repo/eslint-config/react";

export default [...reactConfig, { ignores: ["dev-dist"] }];
