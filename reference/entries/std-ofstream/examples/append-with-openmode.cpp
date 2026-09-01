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
        output << "first\n";
    }
    {
        std::ofstream output{path, std::ios::app};
        output << "second\n";
        output.close();
        if (!output) return 1;
    }

    std::ifstream input{path};
    std::vector<std::string> lines;
    for (std::string line; std::getline(input, line);) lines.push_back(line);
    std::cout << "lines=" << lines.size() << '\n';
    std::cout << lines.at(0) << '|' << lines.at(1) << '\n';
}
