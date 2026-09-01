#include <cstdio>
#include <fstream>
#include <iostream>
#include <string>

struct Cleanup {
    const char* path;
    ~Cleanup() { std::remove(path); }
};

int main() {
    constexpr const char* path = "records.txt";
    std::remove(path);
    Cleanup cleanup{path};
    {
        std::ofstream output{path};
        if (!output) return 1;
        output << "1 Ada\n2 Linus\n";
        output.close();
        if (!output) return 2;
    }

    std::ifstream input{path};
    if (!input) return 3;
    int id{};
    std::string name;
    while (input >> id >> name) {
        std::cout << id << ':' << name << '\n';
    }
    if (!input.eof()) return 4;
    input.clear();
    input.close();
    if (!input) return 5;
}
