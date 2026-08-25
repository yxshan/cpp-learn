import { describe, expect, it } from "vitest";

import { formatCppSource, isCppSourcePath } from "./cpp-format.js";

describe("C++ editor formatting", () => {
  it("expands a compressed starter into conventional C++ layout", () => {
    expect(
      formatCppSource(
        '#include <iostream>\nint main(){std::cout<<"TODO\\n";}\n',
      ),
    ).toBe(
      '#include <iostream>\n\nint main() {\n  std::cout << "TODO\\n";\n}\n',
    );
  });

  it("preserves literals, comments, and for-loop separators", () => {
    expect(
      formatCppSource(
        'int main(){// loop\nfor(int i=0;i<2;++i){std::cout<<"{;}";}/*done*/}\n',
      ),
    ).toBe(
      'int main() {\n  // loop\n  for (int i = 0; i < 2; ++i) {\n    std::cout << "{;}";\n  }\n  /*done*/\n}\n',
    );
  });

  it("separates arithmetic operators without separating unary operators", () => {
    expect(
      formatCppSource(
        "int calculate(){int answer=1+2*3;return -answer + !answer;}",
      ),
    ).toBe(
      "int calculate() {\n  int answer = 1 + 2 * 3;\n  return -answer + !answer;\n}\n",
    );
  });

  it("keeps standard and custom literal suffixes attached", () => {
    expect(
      formatCppSource(
        'auto text="abc"sv;auto raw=R"tag(value)tag"_token;auto number=42_km;',
      ),
    ).toBe(
      'auto text = "abc"sv;\nauto raw = R"tag(value)tag"_token;\nauto number = 42_km;\n',
    );
  });

  it("places switch labels and their statements on conventional indentation", () => {
    expect(
      formatCppSource(
        "int choose(int value){switch(value){case 1:return 0;default:return 1;}}",
      ),
    ).toBe(
      "int choose(int value) {\n  switch (value) {\n    case 1:\n      return 0;\n    default:\n      return 1;\n  }\n}\n",
    );
  });

  it("distinguishes a ternary colon inside a case expression from the label colon", () => {
    expect(
      formatCppSource(
        "int choose(){switch(1){case (true?1:2):return 1;case (false?1:(true?2:3)):return 2;}}",
      ),
    ).toBe(
      "int choose() {\n  switch (1) {\n    case (true ? 1 : 2):\n      return 1;\n    case (false ? 1 : (true ? 2 : 3)):\n      return 2;\n  }\n}\n",
    );
  });

  it("is idempotent for an already formatted source", () => {
    const source = "#pragma once\n\nstruct Point {\n  int x;\n  int y;\n};\n";
    expect(formatCppSource(formatCppSource(source))).toBe(source);
  });

  it("enables formatting only for C and C++ source paths", () => {
    expect(isCppSourcePath("main.cpp")).toBe(true);
    expect(isCppSourcePath("include/value.hpp")).toBe(true);
    expect(isCppSourcePath("CMakeLists.txt")).toBe(false);
    expect(isCppSourcePath("README.md")).toBe(false);
  });
});
