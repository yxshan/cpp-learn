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
        output << "1 Ada\n2 Linus\n";
        output.close();
        if (!output) return 1;
    }

    std::ifstream input{path};
    int id{};
    std::string name;
    while (input >> id >> name) {
        std::cout << id << ':' << name << '\n';
    }
}
