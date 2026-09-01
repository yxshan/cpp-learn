#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

struct Cleanup {
    const char* path;
    ~Cleanup() { std::remove(path); }
};

int main() {
    constexpr const char* path = "append.txt";
    std::remove(path);
    Cleanup cleanup{path};
    {
        std::ofstream output{path};
        if (!output) return 1;
        output << "first\n";
        output.close();
        if (!output) return 2;
    }
    {
        std::ofstream output{path, std::ios::app};
        if (!output) return 3;
        output << "second\n";
        output.close();
        if (!output) return 4;
    }

    std::ifstream input{path};
    if (!input) return 5;
    std::vector<std::string> lines;
    for (std::string line; std::getline(input, line);) {
        lines.push_back(line);
    }
    if (!input.eof()) return 6;
    input.clear();
    input.close();
    if (!input || lines.size() != 2) return 7;
    std::cout << "lines=" << lines.size() << '\n';
    std::cout << lines.at(0) << '|' << lines.at(1) << '\n';
}
