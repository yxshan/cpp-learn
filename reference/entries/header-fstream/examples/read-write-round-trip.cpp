#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

struct Cleanup {
    const char* path;
    ~Cleanup() { std::remove(path); }
};

int main() {
    constexpr const char* path = "round-trip.txt";
    std::remove(path);
    Cleanup cleanup{path};

    std::fstream file{path, std::ios::in | std::ios::out | std::ios::trunc};
    if (!file) return 1;
    file << "status=ready\n";
    file.flush();
    if (!file) return 2;
    file.seekg(0);

    std::string line;
    std::getline(file, line);
    std::cout << line << '\n';
}
