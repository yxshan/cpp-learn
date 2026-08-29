#include <algorithm>
#include <iostream>
#include <string>
#include <vector>

struct Candidate {
    std::string name;
    int score;
};

int main() {
    std::vector<Candidate> candidates{
        {"Zhao", 80},
        {"Ming", 95},
        {"Lin", 95},
    };

    std::sort(candidates.begin(), candidates.end(),
              [](const Candidate& left, const Candidate& right) {
                  if (left.score != right.score) {
                      return left.score > right.score;
                  }
                  return left.name < right.name;
              });

    for (const Candidate& candidate : candidates) {
        std::cout << candidate.name << ':' << candidate.score << '\n';
    }
}
