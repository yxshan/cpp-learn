#include <array>
#include <cstdio>
#include <fstream>
#include <iostream>

struct Cleanup {
    const char* path;
    ~Cleanup() { std::remove(path); }
};

int main() {
    constexpr const char* path = "bytes.bin";
    std::remove(path);
    Cleanup cleanup{path};
    const std::array<unsigned char, 3> written{0, 127, 255};

    {
        std::ofstream output{path, std::ios::binary};
        if (!output) return 1;
        output.write(reinterpret_cast<const char*>(written.data()),
                     static_cast<std::streamsize>(written.size()));
        output.close();
        if (!output) return 2;
    }

    std::array<unsigned char, 3> read{};
    std::ifstream input{path, std::ios::binary};
    input.read(reinterpret_cast<char*>(read.data()),
               static_cast<std::streamsize>(read.size()));
    if (!input) return 3;
    std::cout << "bytes=" << static_cast<int>(read[0]) << ','
              << static_cast<int>(read[1]) << ','
              << static_cast<int>(read[2]) << '\n';
}
