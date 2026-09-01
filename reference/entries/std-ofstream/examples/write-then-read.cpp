#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

struct Cleanup {
    const char* path;
    ~Cleanup() { std::remove(path); }
};

int main() {
    constexpr const char* path = "result.txt";
    std::remove(path);
    Cleanup cleanup{path};
    std::ofstream output{path};
    output << "ready " << 2 << '\n';
    output.close();
    if (!output) return 1;

    std::ifstream input{path};
    std::string status;
    int count{};
    input >> status >> count;
    if (!input) return 2;
    std::cout << "file=" << status << " count=" << count << '\n';
}
