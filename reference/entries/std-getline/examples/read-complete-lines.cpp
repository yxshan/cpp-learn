#include <iostream>
#include <sstream>
#include <string>

int main() {
    std::istringstream input{"alpha\nbeta\n"};
    std::string line;
    int line_number{};

    while (std::getline(input, line)) {
        std::cout << ++line_number << ':' << line << '\n';
    }
}
