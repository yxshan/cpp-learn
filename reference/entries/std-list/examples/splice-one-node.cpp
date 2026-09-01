#include <iostream>
#include <iterator>
#include <list>

void print_values(const char* label, const std::list<int>& values) {
    std::cout << label << '=';
    bool first = true;
    for (const int value : values) {
        std::cout << (first ? "" : ",") << value;
        first = false;
    }
    std::cout << '\n';
}

int main() {
    std::list<int> source{1, 2, 3};
    std::list<int> target{10, 20};
    const auto moved = std::next(source.begin());
    target.splice(std::next(target.begin()), source, moved);

    std::cout << "moved=" << *moved << '\n';
    print_values("source", source);
    print_values("target", target);
}
